# Decentralized Voting System

Production-oriented campus voting architecture with:

- Solidity smart contract for role-aware elections and verified voter whitelisting
- Express + MongoDB backend for auth, wallet submission, and admin verification
- Next.js + Wagmi frontend for signup, admin review, wallet linking, and on-chain voting

## What Changed

This refactor adds the missing production pieces the original demo did not have:

- Three roles: `admin`, `student`, `teacher`
- Role-specific signup fields
- Wallet submission flow after login
- Admin verification dashboard with per-user and bulk whitelist actions
- Election creation with `students`, `teachers`, or `both` eligibility
- Frontend election filtering by verified user role
- Smart contract guardrails that reject votes from the wrong role
- Batched admin verification to reduce out-of-gas risk

## Project Layout

```text
contracts/                 Solidity contract source
migrations/                Truffle deployment scripts
backend/                   Express API, Mongo models, contract signer integration
frontend/                  Next.js app with Wagmi wallet integration
src/, Database_API/        Legacy demo files kept for reference
```

## Smart Contract Highlights

`contracts/Voting.sol` now includes:

- `Role` enum: `None`, `Admin`, `Student`, `Teacher`
- Verified voter registry: `mapping(address => Voter) public voters`
- Role-aware elections with:
  - `studentsAllowed`
  - `teachersAllowed`
- `verifyVoter()` for single wallet verification
- `verifyVoters()` for batched verification
- `vote(electionId, candidateId)` guardrails:
  - wallet must be verified
  - voter must be `Student` or `Teacher`
  - voter role must match election eligibility
  - voter can vote only once per election

## Backend API

Base URL: `http://localhost:4000/api`

Main routes:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /users/me/wallet`
- `GET /admin/verifications`
- `POST /admin/verifications/:userId`
- `POST /admin/verifications/bulk`
- `POST /elections`
- `GET /elections`
- `GET /elections/:electionId`

Backend responsibilities:

- store Web2 identity and role profile data
- mark submitted wallets as `pending`
- use the backend admin signer to whitelist approved addresses on-chain
- fail fast on startup if the backend signer is not the deployed contract owner
- batch `Verify All` calls safely using `VERIFICATION_BATCH_SIZE`
- filter elections for verified students and teachers before rendering

## Frontend Pages

Next.js pages were added under `frontend/src/app`:

- `/login`
- `/signup`
- `/wallet`
- `/admin/verifications`
- `/admin/elections/new`
- `/elections`

Frontend responsibilities:

- collect role-specific signup data
- authenticate against backend JWT
- connect MetaMask using Wagmi
- submit the connected wallet to the backend
- let admins verify pending users
- let admins create role-restricted elections
- let verified users vote directly on-chain

## Setup

### 1. Install dependencies

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Configure environment files

Copy these templates:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.local.example frontend\.env.local
```

Important:

- set `ADMIN_PRIVATE_KEY` in `backend/.env`
- set `INITIAL_ADMIN_ADDRESS` to the address for that same private key
- the migration script uses that wallet address as the contract owner
- the backend refuses to start if the deployed contract owner does not match `ADMIN_PRIVATE_KEY`

### 3. Compile and deploy the contract

```bash
npm run contracts:compile
npm run contracts:migrate:reset
```

After deployment, copy the deployed contract address into:

- `backend/.env` as `CONTRACT_ADDRESS`
- `frontend/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`

### 4. Seed the admin account

Set:

- `ADMIN_SEED_NAME`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

Then run:

```bash
npm run backend:seed-admin
```

### 5. Start the services

```bash
npm run backend:dev
npm run frontend:dev
```

## Production Environment Checklist

### Backend `.env`

Required:

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `RPC_URL`
- `CHAIN_ID`
- `CONTRACT_ADDRESS`
- `ADMIN_PRIVATE_KEY`
- `INITIAL_ADMIN_ADDRESS`
- `VERIFICATION_BATCH_SIZE`

Recommended:

- `ADMIN_SEED_NAME`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

Production notes:

- use a managed MongoDB deployment with IP allowlists
- use a dedicated backend signer wallet, never a personal wallet
- keep `ADMIN_PRIVATE_KEY` in a secrets manager, not in source control
- keep `VERIFICATION_BATCH_SIZE` at `50` or lower unless you benchmark larger batches
- rotate `JWT_SECRET` and use a long random value

### Frontend `.env.local`

Required:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_RPC_URL`

## Recommended Network Strategy

Best low-cost choice for this product:

- Testnet: `Polygon Amoy`
- Mainnet: `Polygon PoS`

Why:

- lowest fees for student and teacher wallets
- easy MetaMask support
- broad RPC/provider support
- practical for frequent admin whitelist writes and campus-scale vote volume

If you want stronger Ethereum alignment and are okay with slightly higher fees:

- Testnet: `Arbitrum Sepolia`
- Mainnet: `Arbitrum One`

Important:

- this implementation uses direct wallet voting, so end users still sign and pay a small gas fee
- if you want near-zero user cost, add a relayer or meta-transaction layer later

## Bulk Verification and Gas Safety

The contract exposes:

- `MAX_BATCH_VERIFY = 100`
- `MAX_CANDIDATES_PER_ELECTION = 50`

The backend additionally chunks bulk verification requests using:

- `VERIFICATION_BATCH_SIZE`

Recommended rule:

- keep backend batch size at `25-50` for predictable gas use
- do not send unlimited arrays from the frontend
- prefer sequential backend chunking for `Verify All`

## Notes

- The original static demo files are still in the repo for reference.
- The new production path is the `backend/ + frontend/ + contracts/` stack.
- You should run contract tests and API integration tests before deploying to a real college environment.
