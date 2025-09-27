const fs = require("fs");
const { ethers } = require("ethers");

// Blockchain RPC Configuration
const providerRPC = {
    evmAppchain: {
        name: "Base",
        rpc: "https://lb.drpc.org/base/AkbrLdFK-0m2qOzFoHIrc7CerracwHkR760dIlZWwHzR",
        chainId: 69,
    },
};

// NFT Contract Details
const MINT_CONTRACT = "0x00005EA00Ac477B1030CE78506496e8C2dE24bf5";
const NFT_CONTRACT = "0xcb710e9c80774c2de19c998a0d6c647361d14220";
const FEE_RECIPIENT = "0x0000a26b00c1F0DF003000390027140000fAa719";
const MINTER_IF_NOT_PAYER = "0x0000000000000000000000000000000000000000";
const QUANTITY = 1;
const GAS_PRICE = "44"; 
const TO_ADDRESS = ""; // Receiver address

// Read Private Keys from File
const FILE_PATH = "privatekeys.txt";
if (!fs.existsSync(FILE_PATH)) {
    console.error("Error: privatekeys.txt not found!");
    process.exit(1);
}

const privateKeys = fs.readFileSync(FILE_PATH, "utf8").split("\n").map(line => line.trim()).filter(line => line);

// Load Provider
const provider = new ethers.JsonRpcProvider(providerRPC.evmAppchain.rpc);

// Contract ABIs
const mintContractABI = [
    "function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) external payable",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const nftContractABI = [
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes _data) external"
];

// Mint Function
async function mintNFT(wallet, index) {
    try {
        console.log(`[Wallet #${index}] Minting NFT from ${wallet.address}...`);

        const mintContract = new ethers.Contract(MINT_CONTRACT, mintContractABI, wallet);

        const tx = await mintContract.mintPublic(
            NFT_CONTRACT,
            FEE_RECIPIENT,
            MINTER_IF_NOT_PAYER,
            QUANTITY,
            { 
                value: ethers.parseUnits('0.02', 'ether'),
                gasPrice: ethers.parseUnits(GAS_PRICE, 'gwei')
            }
        );

        console.log(`[Wallet #${index}] Transaction sent! TX Hash: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`[Wallet #${index}] Mint confirmed in block: ${receipt.blockNumber}`);

        // Extract Token ID
        let tokenId = null;
        for (const log of receipt.logs) {
            try {
                const parsedLog = mintContract.interface.parseLog(log);
                if (parsedLog && parsedLog.name === "Transfer") {
                    tokenId = parsedLog.args.tokenId;
                    console.log(`[Wallet #${index}] Minted NFT Token ID: ${tokenId}`);
                    break;
                }
            } catch (err) {
             
            }
        }

        if (!tokenId) {
            console.error(`[Wallet #${index}] Token ID not found! Skipping transfer.`);
            return;
        }

        // Transfer NFT to TO_ADDRESS
        await transferNFT(wallet, tokenId, index);

    } catch (error) {
        console.error(`[Wallet #${index}] Error minting NFT:`, error);
    }
}

async function transferNFT(wallet, tokenId, index) {
    try {
        console.log(`[Wallet #${index}] Transferring NFT (Token ID: ${tokenId}) to ${TO_ADDRESS}...`);

        const nftContract = new ethers.Contract(NFT_CONTRACT, nftContractABI, wallet);

        const tx = await nftContract.safeTransferFrom(wallet.address, TO_ADDRESS, tokenId, "0x"); 

        console.log(`[Wallet #${index}] Transfer transaction sent! TX Hash: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`[Wallet #${index}] Transfer confirmed in block: ${receipt.blockNumber}`);
        console.log(`[Wallet #${index}] NFT (Token ID: ${tokenId}) successfully transferred to ${TO_ADDRESS}`);
    } catch (error) {
        console.error(`[Wallet #${index}] Error transferring NFT:`, error);
    }
}

async function mintAndTransferWithAllWallets() {
    if (privateKeys.length === 0) {
        console.error("Error: No private keys found in privatekeys.txt");
        return;
    }

    console.log(`Starting minting with ${privateKeys.length} wallets...`);

    const mintingTasks = privateKeys.map((pk, index) => {
        const wallet = new ethers.Wallet(pk, provider);
        return mintNFT(wallet, index);
    });

    await Promise.all(mintingTasks);

    console.log("✅ All wallets have completed minting and transfers.");
}

// Schedule Function
function scheduleMinting() {
    const targetHour = 23;
    const targetMinute = 0;
    const targetSecond = 0;
    const targetMillisecond = 0; // 50 milliseconds

    const now = new Date();
    now.setMilliseconds(0);

    // Calculate target time in UTC+7
    let targetTime = new Date();
    targetTime.setUTCHours(targetHour - 7, targetMinute, targetSecond, targetMillisecond); // Adjust to UTC

    // If the time has already passed today, schedule for tomorrow
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }

    const delay = targetTime - now;

    console.log(`⏳ Minting will start at: ${targetTime.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })} UTC+7`);
    console.log(`🕐 Waiting ${delay / 1000} seconds before starting...`);

    setTimeout(() => {
        console.log("🚀 Starting minting process now...");
        mintAndTransferWithAllWallets();
    }, delay);
}

// Start the scheduling
scheduleMinting();
