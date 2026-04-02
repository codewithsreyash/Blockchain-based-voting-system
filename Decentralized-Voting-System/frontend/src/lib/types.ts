export type UserRole = "admin" | "student" | "teacher";
export type VerificationStatus = "not_submitted" | "pending" | "verified";
export type EligibleVoters = "students" | "teachers" | "both" | "none";
export type AppNetwork = "amoy" | "local";

export interface NetworkDetails {
  key: AppNetwork;
  label: string;
  mode: "production" | "demo";
  chainId: number;
  contractAddress: string | null;
  rpcUrl: string;
  note?: string;
}

export interface NetworkStatusResponse {
  defaultNetwork: AppNetwork;
  networks: Record<AppNetwork, NetworkDetails>;
}

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  studentId?: string;
  major?: string;
  department?: string;
  employeeId?: string;
  walletAddress?: string;
  verificationStatus: VerificationStatus;
  walletSubmittedAt?: string;
  verifiedAt?: string;
  lastVerificationTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: number;
  name: string;
  metadataURI: string;
  voteCount: number;
}

export interface Election {
  id: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  studentsAllowed: boolean;
  teachersAllowed: boolean;
  candidateCount: number;
  eligibleVoters: EligibleVoters;
  candidates: Candidate[];
}

export interface ElectionResultCandidate extends Candidate {
  percentage: number;
  isWinner: boolean;
}

export interface ElectionResults {
  election: Omit<Election, "candidates">;
  totalVotes: number;
  hasTie: boolean;
  winners: ElectionResultCandidate[];
  candidates: ElectionResultCandidate[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PendingVerificationResponse {
  students: User[];
  teachers: User[];
}
