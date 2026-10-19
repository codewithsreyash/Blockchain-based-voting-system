# Blockchain-Based Voting System

A decentralized voting application built to demonstrate how blockchain smart contracts can support transparent election workflows and enforce voting rules.

**Live Demo:** https://blockchain-based-voting-system-weld.vercel.app  
**Source Code:** https://github.com/codewithsreyash/Blockchain-based-voting-system

## Overview

The Blockchain-Based Voting System is a self-directed project focused on decentralized voting and election integrity. It combines a web application with Ethereum-compatible smart contracts to help make election rules and vote handling more transparent.

## Key Features

- **Smart-contract-based voting:** Uses Solidity and Ethereum-compatible smart contracts.
- **Voter verification:** Supports voter verification as part of the election workflow.
- **Single-vote enforcement:** Prevents a registered wallet from voting more than once.
- **Election time controls:** Supports time-bound election workflows.
- **Access control:** Uses role-based permissions for protected election actions.
- **Wallet connectivity:** Connects the web application to MetaMask.
- **Full-stack architecture:** Includes a web frontend and a backend for application services and authentication.

## Technology Stack

| Area | Technologies |
|---|---|
| Smart contracts | Solidity, Ethereum |
| Frontend | Next.js, React, TypeScript |
| Web3 integration | MetaMask, Wagmi, Viem |
| Backend | Node.js |
| Database | MongoDB |
| Authentication | JWT |

## Project Links

- **Live application:** https://blockchain-based-voting-system-weld.vercel.app
- **GitHub repository:** https://github.com/codewithsreyash/Blockchain-based-voting-system

## Getting Started

To run the project locally, clone the repository and follow the setup instructions and environment-variable requirements defined in the project files.

```bash
git clone https://github.com/codewithsreyash/Blockchain-based-voting-system.git
cd Blockchain-based-voting-system
```

Install dependencies and start the frontend/backend using the scripts documented in the repository's package files. Configure any required environment variables before running the application. Do not commit secrets, private keys, JWT secrets, or production credentials.

## Security and Scope

This project is intended for learning and demonstration. A blockchain-based design alone does not guarantee voter anonymity, identity assurance, coercion resistance, or suitability for real public elections. A production election system would require independent security audits, robust identity and privacy mechanisms, legal review, accessibility testing, and operational safeguards.

## Author

**Sreyash Rajendra Donewar**

- GitHub: https://github.com/codewithsreyash
