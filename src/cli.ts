import yargs from "yargs"
import tradfri, {LightLevels, LightState} from "./lib"
const args = yargs
    .usage("Usage: tradfri-cli -n <friendly-name> [-a ip:port] [-w number] [-b 0-254] [-s on|off]")
    .wrap(yargs.terminalWidth())
    .options({
        state: {
            choices: ["ON", "OFF", "toggle"],
            // The cast needs to be otherwise typing is not correct
            // https://github.com/yargs/yargs/issues/1641
            default: "toggle" as "ON" | "OFF" | "toggle",
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
        level: {
            type: "number",
            alias: "l",
            desc: "Set the light level. This is a predefined mix of warmth and brightness"
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

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const setTo = ((): LightState => {
    if (typeof args.level !== "undefined") {
        const level = clamp(args.level, 0, 2);
        return LightLevels[level];
    }

    return {
        brightness: args.brightness,
        state: args.state,
        color_temp: args.warmth
    };
})();

(async () => {
    const client = await tradfri.createClient(args["broker-address"]);
    await tradfri.send({
        type: "set",
        client,
        ...setTo,
        "friendly-name": args["friendly-name"]
    });
    client.end();
})();
