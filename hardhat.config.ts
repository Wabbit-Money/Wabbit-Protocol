import "@nomiclabs/hardhat-waffle";
import {task} from "hardhat/config";

import fast from "./scripts/fast";

import dotenv from "dotenv";
dotenv.config();

task("deploy-main", "Deploy contracts onto mainnet", async (args, hre) => await fast(false, hre));

task("deploy-test", "Deploy contracts onto testnet", async (args, hre) => await fast(true, hre));

task("deploy-fork", "Deploy contracts onto forked network", async (args, hre) => await fast(false, hre));

const NETWORK_URL = "https://rpc.ftm.tools/";
const NETWORK_URL_TEST = "";

export default {
    solidity: {
        compilers: [{version: "0.8.4", settings: {optimizer: {enabled: true, runs: 200}}}],
    },
    networks: {
        hardhat: {
            forking: {
                url: NETWORK_URL,
            },
        },
        mainnet: {
            url: NETWORK_URL,
            accounts: [process.env.PRIVATE_KEY],
        },
        testnet: {
            url: NETWORK_URL_TEST,
            accounts: [process.env.PRIVATE_KEY],
        },
    },
};
