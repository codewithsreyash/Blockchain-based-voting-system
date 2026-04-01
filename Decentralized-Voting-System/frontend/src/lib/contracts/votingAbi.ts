export const votingAbi = [
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "electionId",
        type: "uint256",
      },
      {
        name: "candidateId",
        type: "uint256",
      },
    ],
    outputs: [],
  },
] as const;
