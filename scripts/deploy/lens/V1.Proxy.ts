import hre from "hardhat";

import { loadData } from "../../utils";

async function main() {
    const data = loadData();

    const beacon = data.contracts.VaultV1.beacon;

    // wFTM, USDC
    const tokens = ["0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75"];
    const strategy = "0x6Ad07E659563490d40377a98a7f0f62ed7d38C41";
    const feeRecipient = data.contracts.timelock;
    const feePercent = 0;
    const feeDenominator = 100;

    const VaultV1 = await hre.ethers.getContractFactory("TorqueVaultV1");
    const vaultV1 = await hre.upgrades.deployBeaconProxy(beacon, VaultV1, [tokens, strategy, feeRecipient, feePercent, feeDenominator]);
    await vaultV1.deployed();

    console.log("Deploy VaultV1 | Proxy:", vaultV1.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
