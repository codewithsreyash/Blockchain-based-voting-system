
pragma solidity ^0.5.15;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string party; 
        uint voteCount;
    }

    mapping (uint => Candidate) public candidates;
    mapping (address => bool) public voters;

    
    uint public countCandidates;
    uint256 public votingEnd;
    uint256 public votingStart;

    event DateUpdated(uint256 startDate, uint256 endDate);


    function addCandidate(string memory name, string memory party) public  returns(uint) {
               countCandidates ++;
               candidates[countCandidates] = Candidate(countCandidates, name, party, 0);
               return countCandidates;
    }
   
    function vote(uint candidateID) public {

       require((votingStart <= now) && (votingEnd > now));
   
       require(candidateID > 0 && candidateID <= countCandidates);

       //daha önce oy kullanmamıs olmalı
       require(!voters[msg.sender]);
              
       voters[msg.sender] = true;
       
       candidates[candidateID].voteCount++;      
    }
    
    function checkVote() public view returns(bool){
        return voters[msg.sender];
    }
       
    function getCountCandidates() public view returns(uint) {
        return countCandidates;
    }

    function getCandidate(uint candidateID) public view returns (uint,string memory, string memory,uint) {
        return (candidateID,candidates[candidateID].name,candidates[candidateID].party,candidates[candidateID].voteCount);
    }

    function setDates(uint256 _startDate, uint256 _endDate) public{
        require(_endDate > _startDate, "End date must be after start date.");
        
        // Allow keeping the existing start date even if it's in the past
        // If it is a new start date, it must be in the future (or now)
        if (votingStart == 0 || _startDate != votingStart) {
             require(_startDate >= now, "Start date must be in the future.");
        }

        votingEnd = _endDate;
        votingStart = _startDate;
        emit DateUpdated(_startDate, _endDate);
    }

    function getDates() public view returns (uint256,uint256) {
      return (votingStart,votingEnd);
    }
}
