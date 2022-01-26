import {HardhatRuntimeEnvironment} from "hardhat/types";
import {chooseConfig, ConfigType, saveConfig} from "../util/utilConfig";
import {saveTempConstructor} from "../util/utilVerify";

export default async function main(configType: ConfigType, hre: HardhatRuntimeEnvironment) {
    const config = chooseConfig(configType);

    const constructorArgs = {
        pool: config.leveragePoolAddress,
        oracle: config.oracleAddress,
        minMarginLevelPercentNumerator: 105,
        minMarginLevelPercentDenominator: 100,
        minCollateralPrice: hre.ethers.BigNumber.from(10).pow(18).mul(100),
        maxLeverage: 125,
        liquidationFeePercentNumerator: 10,
        liquidationFeePercentDenominator: 100,
    };

    const MarginLong = await hre.ethers.getContractFactory("MarginLong");
    const marginLong = await hre.upgrades.deployProxy(MarginLong, Object.values(constructorArgs));

    config.marginLongAddress = marginLong.address;
    config.marginLongResolvedAddress = await marginLong.resolvedAddress;
    console.log(`Deployed: Margin long proxy and margin long | ${marginLong.address} ${await marginLong.resolvedAddress}`);

    if (configType !== "fork") saveTempConstructor(await marginLong.resolvedAddress, {});
    saveConfig(config, configType);
}
