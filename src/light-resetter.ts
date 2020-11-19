import yargs from "yargs"
import MQTT from "async-mqtt"
import log from "./log"
import tradfri, {LightState} from "./lib"

const args = yargs
    .usage("Usage: light_resetter -n <light-name> [-a broker-address]")
    .wrap(yargs.terminalWidth())
    .options({
        "light-name": {
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

const resetter = async (client: MQTT.AsyncMqttClient, lastState: LightState, state: LightState) => {
    log(resetter, `state: ${lastState.state} -> ${state.state}, `
                + `brightness: ${lastState.brightness} -> ${state.brightness}, `
                + `color_temp: ${lastState.color_temp} -> ${state.color_temp}`);
    if (!(lastState.state === "OFF" && state.state === "ON")) {
        log(resetter, "Ignoring: the light didn't turn on.");
        return;
    }
    if (state.brightness === 254 && state.color_temp === 350) {
        log(resetter, "Ignoring: the light is in default state.");
        return;
    }

    log(resetter, "The light turned on with non-default brightness/color_temp, resetting...");
    await tradfri.send({
        state: "ON",
        color_temp: 350,
        "friendly-name": args["light-name"],
        type: "set",
        brightness: 254,
        client
    });
};

const stateEqual = (a: LightState, b: LightState) => a.brightness === b.brightness && a.color_temp === b.color_temp && a.state === b.state;


const main = async () => {
    log(main, "Connecting to the broker...");
    const client = await tradfri.createClient(args["broker-address"]);
    log(main, "Connected.");
    const subTo = args["light-name"];
    log(main, `Subscribing to '${subTo}'...`);
    let lastState: LightState | undefined;
    let firstStatePromise = new Promise(async (resolve) => await tradfri.subscribe({
        client,
        "friendly-name": subTo,
        subType: "light",
        callback: async (state: LightState) => {
            if (typeof lastState === "undefined") {
                log(main, `Got first state: state: ${state.state}, brightness: ${state.brightness}, color_temp: ${state.color_temp}`);
                lastState = state;
                resolve();
                return;
            }

            // The states usually come in duplicates, this gets somewhat rid of that. However, the messages can
            // sometimes come so quickly after each other that `resetter` doesn't handle them fast enough. This doesn't
            // seem to alter the functionality, so I'll leave it like this.
            if (stateEqual(state, lastState)) {
                return;
            }

            log(main, "Got new light state.");
            await resetter(client, lastState, state);
            lastState = state;
        }
    }));
    log(main, "Subscribed.");
    log(main, "Getting the first event...");
    tradfri.send({
        type: "get",
        "friendly-name": "ikea",
        client
    });
    await firstStatePromise;
    log(main, "Listening for events...");
};


main();
