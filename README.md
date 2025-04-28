![github-submission-banner](https://github.com/user-attachments/assets/a1493b84-e4e2-456e-a791-ce35ee2bcf2f)

# ⚡ Monad Arcade

> Provably fair, on-chain casual games built for the speed and scale of Monad.

---

## 📌 Problem Statement

**Problem Statement: Building Decentralized Applications (dApps)**

The challenge of creating user-friendly, performant, and truly decentralized applications that leverage the unique capabilities of blockchain technology, specifically within the high-throughput environment of Monad. A sub-problem addressed is the lack of transparent and verifiable random outcomes in traditional online gaming.

---

## 🎯 Objective

Monad Arcade aims to solve the problem of centralized and opaque online gaming by providing a suite of simple, provably fair casual games running directly on the Monad blockchain. It serves blockchain enthusiasts and casual gamers seeking a trustless gaming experience where game logic, randomness, and payouts are verifiable on-chain. The real-world value lies in demonstrating that blockchain, particularly a high-performance chain like Monad, can host interactive, engaging applications with built-in transparency and security for users' assets.

---

## 🧠 Team & Approach

### Team Name:
`[Your Team Name Here]`

### Team Members:
- [Your Name 1] ([GitHub Link] / [LinkedIn Link] / [Your Role])
- [Your Name 2] ([GitHub Link] / [LinkedIn Link] / [Your Role])
- [Your Name 3] ([GitHub Link] / [LinkedIn Link] / [Your Role])
*(Add links if you want)*

### Your Approach:
- We chose this problem to demonstrate the practical application of smart contracts and blockchain technology for interactive, user-facing products beyond just finance or collectibles. Casual games provide a great use case for showcasing transparent logic and direct value transfer.
- Key challenges addressed included implementing game logic fairly and efficiently within Solidity, handling on-chain randomness securely (or simulating for demonstration), and building a responsive frontend that interacts seamlessly with the blockchain using `wagmi` and monitors real-time events for instant UI updates.
- During hacking, a significant breakthrough was successfully integrating multiple distinct game types into a single contract and frontend structure, proving the scalability of the dApp architecture on Monad. Adapting client-side UI states (like animations and loading) to reliably follow on-chain transaction and event lifecycles was also a key focus.

---

## 🛠️ Tech Stack

### Core Technologies Used:
- Frontend: Next.js, React, TypeScript, Tailwind CSS, Shadcn UI
- Smart Contract: Solidity, Hardhat/Foundry (for development/testing)
- Database: Monad Blockchain
- APIs: Standard RPC endpoints via `wagmi`
- Hosting: Vercel/Netlify (for frontend), Monad Blockchain (for contract)

### Sponsor Technologies Used (if any):
- [ ] **Groq:** _[Explain if used, e.g., for AI-driven game hints, player analytics, etc.]_
- [x] **Monad:** Our core blockchain implementation. We built and deployed our smart contract on the Monad Testnet, leveraging its EVM compatibility and experiencing its performance for transaction processing and event propagation.
- [ ] **Fluvio:** _[Explain if used, e.g., for real-time stream processing related to game events]_
- [ ] **Base:** _[Explain if used, e.g., Smart Wallet integration for easier user onboarding]_
- [ ] **Screenpipe:** _[Explain if used, e.g., for analyzing user interaction patterns]_
- [ ] **Stellar:** _[Explain if used, e.g., for handling game payouts or cross-chain elements]_
*(Mark with ✅ if completed, [x] for used)*
---

## ✨ Key Features

Highlight the most important features of your project:

- ✅ **Multi-Game Arcade:** A single dApp featuring multiple distinct casual games (Dice, Coin Flip, Jackpot, Lightning Race, Crypto Slots).
- ✅ **On-Chain Betting & Payouts:** Players place bets and receive winnings directly via smart contract interactions.
- ✅ **Provably Fair Outcomes:** Game results are determined by logic within the Solidity contract. (Note: For true decentralization, integrates with a Verifiable Random Function like Chainlink VRF - *Our current implementation uses owner-triggered randomness for demonstration, but can be upgraded*).
- ✅ **Real-time Updates:** UI reacts to on-chain events (`wagmi` event listeners) to show game results and history instantly.
- ✅ **Wallet Integration:** Seamless connection with web3 wallets (like MetaMask) for transactions via `wagmi`.
- ✅ **Transparent Game History:** Records of bets and outcomes stored immutably on the blockchain and displayed in the UI.

Add images, GIFs, or screenshots if helpful!
*(Add screenshots/GIFs of each game)*

---

## 📽️ Demo & Deliverables

- **Demo Video Link:** [https://youtu.be/43OLTWyZrW0]

---

## ✅ Tasks & Bonus Checklist

- [ ] **All members of the team completed the mandatory task - Followed at least 2 of our social channels and filled the form** (Details in Participant Manual)
- [ ] **All members of the team completed Bonus Task 1 - Sharing of Badges and filled the form (2 points)**  (Details in Participant Manual)
- [ ] **All members of the team completed Bonus Task 2 - Signing up for Sprint.dev and filled the form (3 points)**  (Details in Participant Manual)

*(Mark with ✅ if completed)*

---

## 🧪 How to Run the Project

### Requirements:
- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)
- A web3 wallet (e.g., MetaMask) connected to the Monad Testnet.
- Testnet MON tokens in your wallet.
- A deployed MonadArcade smart contract address and its ABI.

### Local Setup:

1.  **Clone the repo:**
    ```bash
    git clone [https://github.com/your-team/monad-arcade.git](https://github.com/your-team/monad-arcade.git)
    cd monad-arcade
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    # or npm install
    # or yarn install
    ```
3.  **Setup Environment Variables:**
     Added my Monad Testnet RPC URL and the deployed contract address and ABI.

5.  **Start development server:**
    ```bash
    pnpm run dev
    # or npm run dev
    # or yarn dev
    ```
6.  Open your browser and navigate to `http://localhost:3000`.

Remember that for the Lightning Race and Slots games (in their current owner-triggered randomness implementation), the contract owner (you) will need to call the respective resolve functions (`resolveLightningRace`, `_resolveSlotsGame` - note the underscore if it's internal) on the deployed contract after a player places a bet for the game outcome to be finalized on-chain and the event emitted.

---

## 🧬 Future Scope

- 📈 Integrate Chainlink VRF or another decentralized randomness solution for truly trustless outcomes in all games.
- 🛡️ Implement comprehensive input validation and error handling in both smart contract and frontend.
- 🌐 Improve UI/UX, add animations, sound effects, and mobile responsiveness.
- 👤 Implement user profiles and persistent game statistics (win/loss streaks, total wagered/won).
- 🔥 Optimize smart contract for gas efficiency.
- 📊 Add a global leaderboard fetched from on-chain data or indexed events.
- ⚙️ Explore adding more game types.

---

## 📎 Resources / Credits

- wagmi (React Hooks for Ethereum)
- viem (TypeScript library for EVM)
- Next.js (React Framework)
- Tailwind CSS (CSS Framework)
- Shadcn UI (Reusable UI components)
- Lucide React (Icon library)
- Solidity (Smart Contract Language)
- Hardhat / Foundry (Smart Contract Development Environment)
- Monad Documentation
- Etherscan/Monadscan (for verifying transactions and contract interaction)

---

## 🏁 Final Words

Building on Monad has been an exciting experience! Navigating the integration of smart contract logic with a dynamic frontend, managing transaction states, and leveraging on-chain events presented unique challenges and rewarding breakthroughs. We're proud to contribute this early dApp to the Monad ecosystem and look forward to seeing more innovative applications built on this high-performance chain.
