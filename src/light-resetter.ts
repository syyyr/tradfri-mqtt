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

const reset = async (client: MQTT.AsyncMqttClient) => {
    log(reset, "Resetting light.");
    await tradfri.send({
        state: "ON",
        color_temp: 350,
        "friendly-name": args["light-name"],
        type: "set",
        brightness: 254,
        client
    });
};

const stateHandler = async (client: MQTT.AsyncMqttClient, lastState: LightState, state: LightState) => {
    if (!(lastState.state === "OFF" && state.state === "ON")) {
        log(stateHandler, "Ignoring: the light didn't turn on.");
        return;
    }
    if (state.brightness === 254 && state.color_temp === 350) {
        log(stateHandler, "Ignoring: the light is in default state.");
        return;
    }

    log(stateHandler, "The light turned on with non-default brightness/color_temp.");
    reset(client);
};

const stateEqual = (a: LightState, b: LightState) => a.brightness === b.brightness && a.color_temp === b.color_temp && a.state === b.state;


const main = async () => {
    log(main, "Connecting to the broker...");
    const client = await tradfri.createClient(args["broker-address"]);
    log(main, "Connected.");
    const subTo = args["light-name"];
    log(main, `Subscribing to '${subTo}'...`);
    let lastState: LightState | undefined;
    let supressNext = false;
    let firstStatePromise = new Promise<void>(async (resolve) => await tradfri.subscribe({
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

            log(main, `New state: ${lastState.state} -> ${state.state}, `
                    + `brightness: ${lastState.brightness} -> ${state.brightness}, `
                    + `temp: ${lastState.color_temp} -> ${state.color_temp}`);
            if (supressNext) {
                log(main, "Ignoring.");
                supressNext = false;
                lastState = state;
                return;
            }

            await stateHandler(client, lastState, state);
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
    const firstStateWaiter = global.setTimeout(() => {
        log(main, "Couldn't retrieve first state. Exiting.");
        process.exit(1);
    }, 10000);
    await firstStatePromise;
    global.clearTimeout(firstStateWaiter);

    log(main, "Subscribing to device announces...");
    await tradfri.subscribe({
        client,
        "friendly-name": subTo,
        subType: "announce",
        callback: () => {
            log(main, "Device was powered on.");
            reset(client);
        }
    });
    log(main, "Subscribed.");
    log(main, "Subscribing to generic messages.");
    await tradfri.subscribe({
        client,
        "friendly-name": "light-resetter",
        subType: "tradfri",
        callback: (msg: string) => {
            switch (msg) {
                case "supress-next":
                    log(main, "Next light state will be ignored.");
                    supressNext = true;
                    break;
                default:
                    log(main, `Message not understood: '${msg}'`);
            }
        }
    });
    log(main, "Subscribed.");

    log(main, "Listening for events...");
};


main();
