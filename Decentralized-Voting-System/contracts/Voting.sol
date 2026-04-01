// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Voting {
    enum Role {
        None,
        Admin,
        Student,
        Teacher
    }

    struct Voter {
        Role role;
        bool verified;
    }

    struct Election {
        uint256 id;
        string title;
        string description;
        uint64 startTime;
        uint64 endTime;
        bool isActive;
        bool studentsAllowed;
        bool teachersAllowed;
        bool exists;
        uint256 candidateCount;
    }

    struct Candidate {
        uint256 id;
        string name;
        string metadataURI;
        uint256 voteCount;
    }

    uint256 public electionCount;
    uint256 public constant MAX_BATCH_VERIFY = 100;
    uint256 public constant MAX_CANDIDATES_PER_ELECTION = 50;
    address public owner;

    mapping(address => Voter) public voters;
    mapping(uint256 => Election) private elections;
    mapping(uint256 => mapping(uint256 => Candidate)) private electionCandidates;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event AdminGranted(address indexed admin);
    event VoterVerified(address indexed voter, Role role);
    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        bool studentsAllowed,
        bool teachersAllowed,
        uint64 startTime,
        uint64 endTime
    );
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionDeactivated(uint256 indexed electionId);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier electionExists(uint256 electionId) {
        require(elections[electionId].exists, "Election does not exist");
        _;
    }

    constructor(address initialAdmin) {
        address admin = initialAdmin == address(0) ? msg.sender : initialAdmin;
        owner = admin;
        voters[admin] = Voter({ role: Role.Admin, verified: true });

        emit OwnerTransferred(address(0), admin);
        emit AdminGranted(admin);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero");

        address previousOwner = owner;
        owner = newOwner;
        voters[newOwner] = Voter({ role: Role.Admin, verified: true });

        emit OwnerTransferred(previousOwner, newOwner);
        emit AdminGranted(newOwner);
    }

    function verifyVoter(address voter, Role role) public onlyOwner {
        require(voter != address(0), "Invalid wallet address");
        require(role == Role.Student || role == Role.Teacher || role == Role.Admin, "Invalid role");

        voters[voter] = Voter({ role: role, verified: true });
        if (role == Role.Admin) {
            emit AdminGranted(voter);
        }
        emit VoterVerified(voter, role);
    }

    function verifyVoters(address[] calldata voterAddresses, Role[] calldata roles) external onlyOwner {
        uint256 total = voterAddresses.length;

        require(total > 0, "No voters supplied");
        require(total == roles.length, "Input length mismatch");
        require(total <= MAX_BATCH_VERIFY, "Batch too large");

        for (uint256 index = 0; index < total; index++) {
            verifyVoter(voterAddresses[index], roles[index]);
        }
    }

    function createElection(
        string calldata title,
        string calldata description,
        string[] calldata candidateNames,
        bool studentsAllowed,
        bool teachersAllowed,
        uint64 startTime,
        uint64 endTime
    ) external onlyOwner returns (uint256 electionId) {
        require(bytes(title).length > 0, "Title is required");
        require(candidateNames.length >= 2, "At least two candidates required");
        require(candidateNames.length <= MAX_CANDIDATES_PER_ELECTION, "Too many candidates");
        require(studentsAllowed || teachersAllowed, "At least one role must be eligible");
        require(startTime >= block.timestamp, "Start time must be in the future");
        require(endTime > startTime, "End time must be after start time");

        electionCount++;
        electionId = electionCount;

        Election storage election = elections[electionId];
        election.id = electionId;
        election.title = title;
        election.description = description;
        election.startTime = startTime;
        election.endTime = endTime;
        election.isActive = true;
        election.studentsAllowed = studentsAllowed;
        election.teachersAllowed = teachersAllowed;
        election.exists = true;
        election.candidateCount = candidateNames.length;

        for (uint256 index = 0; index < candidateNames.length; index++) {
            uint256 candidateId = index + 1;
            electionCandidates[electionId][candidateId] = Candidate({
                id: candidateId,
                name: candidateNames[index],
                metadataURI: "",
                voteCount: 0
            });

            emit CandidateAdded(electionId, candidateId, candidateNames[index]);
        }

        emit ElectionCreated(
            electionId,
            title,
            studentsAllowed,
            teachersAllowed,
            startTime,
            endTime
        );
    }

    function deactivateElection(uint256 electionId) external onlyOwner electionExists(electionId) {
        Election storage election = elections[electionId];

        require(election.isActive, "Election already inactive");
        election.isActive = false;

        emit ElectionDeactivated(electionId);
    }

    function vote(uint256 electionId, uint256 candidateId) external electionExists(electionId) {
        Voter memory voterProfile = voters[msg.sender];
        Election storage election = elections[electionId];

        require(election.isActive, "Election is inactive");
        require(voterProfile.verified, "Wallet is not verified");
        require(
            voterProfile.role == Role.Student || voterProfile.role == Role.Teacher,
            "Only students and teachers can vote"
        );
        require(_isRoleAllowed(election, voterProfile.role), "Role is not eligible for this election");
        require(block.timestamp >= election.startTime, "Voting has not started");
        require(block.timestamp < election.endTime, "Voting has ended");
        require(!hasVoted[electionId][msg.sender], "Vote already cast for this election");
        require(candidateId > 0 && candidateId <= election.candidateCount, "Invalid candidate");

        hasVoted[electionId][msg.sender] = true;
        electionCandidates[electionId][candidateId].voteCount++;

        emit VoteCast(electionId, candidateId, msg.sender);
    }

    function canAddressVote(address voter, uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (bool)
    {
        Voter memory voterProfile = voters[voter];
        Election memory election = elections[electionId];

        if (!voterProfile.verified) {
            return false;
        }

        if (hasVoted[electionId][voter]) {
            return false;
        }

        if (!election.isActive) {
            return false;
        }

        if (block.timestamp < election.startTime || block.timestamp >= election.endTime) {
            return false;
        }

        return _isRoleAllowed(election, voterProfile.role);
    }

    function getElection(uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (
            uint256 id,
            string memory title,
            string memory description,
            uint64 startTime,
            uint64 endTime,
            bool isActive,
            bool studentsAllowed,
            bool teachersAllowed,
            uint256 candidateCount
        )
    {
        Election memory election = elections[electionId];

        return (
            election.id,
            election.title,
            election.description,
            election.startTime,
            election.endTime,
            election.isActive,
            election.studentsAllowed,
            election.teachersAllowed,
            election.candidateCount
        );
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        electionExists(electionId)
        returns (
            uint256 id,
            string memory name,
            string memory metadataURI,
            uint256 voteCount
        )
    {
        Candidate memory candidate = electionCandidates[electionId][candidateId];
        require(candidate.id != 0, "Candidate does not exist");

        return (candidate.id, candidate.name, candidate.metadataURI, candidate.voteCount);
    }

    function getRole(address voter) external view returns (Role) {
        return voters[voter].role;
    }

    function _isRoleAllowed(Election memory election, Role role) internal pure returns (bool) {
        if (role == Role.Student) {
            return election.studentsAllowed;
        }

        if (role == Role.Teacher) {
            return election.teachersAllowed;
        }

        return false;
    }
}
