import yargs from "yargs"
import tradfri from "./lib"
const args = yargs
    .usage("Usage: tradfri-cli -n <friendly-name> [-a ip:port] [-w number] [-b 0-254] [-s on|off]")
    .wrap(yargs.terminalWidth())
    .options({
        state: {
            choices: ["on", "off", "toggle"],
            // The cast needs to be otherwise typing is not correct
            // https://github.com/yargs/yargs/issues/1641
            default: "toggle" as "on" | "off" | "toggle",
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

const checkNumberArg = (name: string, value: number) => {
    if (Number.isNaN(value)) {
        console.error(`Argument to --${name} is not a number.`);
        process.exit(1);
    }
};

checkNumberArg("warmth", args.warmth);
checkNumberArg("brightness", args.brightness);

tradfri.send(args);
