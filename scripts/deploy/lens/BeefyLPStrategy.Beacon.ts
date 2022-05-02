import hre from "hardhat";

async function main() {
    const BeefyLPStrategy = await hre.ethers.getContractFactory("BeefyLPStrategy");
    const beacon = await hre.upgrades.deployBeacon(BeefyLPStrategy);
    await beacon.deployed();

    console.log("Deploy BeefyLPStrategy | Beacon:", beacon.address);
    console.log("Deploy BeefyLPStrategy | Implementation:", await hre.upgrades.beacon.getImplementationAddress(beacon.address));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
