import yargs from "yargs"
import tradfri from "./lib"
const args = yargs
    .usage("Usage: tradfri-cli -n <friendly-name> [-a ip:port] [-w number] [-b 0-254] [-s on|off]")
    .wrap(yargs.terminalWidth())
    .options({
        state: {
            choices: ["on", "off", "toggle"],
            default: "toggle",
            alias: "s",
            desc: "Set the light state"
        },
        warmth: {
            type: "number",
            default: 350,
            alias: "w",
            desc: "Set the temperature of the light, values between 250 and 500 work fine"
        },
        brightness: {
            type: "number",
            default: 254,
            alias: "b",
            desc: "Set the brightness"
        },
        "friendly-name": {
            type: "string",
            demandOption: true,
            alias: ["name", "n"],
            desc: "Set the friendly name of the light"
        },
        "broker-address": {
            type: "string",
            default: "localhost:1883",
            alias: ["a", "broker"],
            desc: "Set the address of the broker"
        },
    }).argv;

tradfri(args);
