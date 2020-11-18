import yargs from "yargs"
import MQTT from "async-mqtt"
import tradfri, {Action, LightState} from "./lib"

const args = yargs
    .usage("Usage: tradfri-remote -n <remote-name>")
    .wrap(yargs.terminalWidth())
    .options({
        "remote-name": {
            type: "string",
            demandOption: true,
            alias: ["name", "n"],
            desc: "Set the friendly name of the remote name"
        },
        "broker-address": {
            type: "string",
            default: "localhost:1883",
            alias: ["a", "broker"],
            desc: "Set the address of the broker"
        },
    }).argv;

const log = (fn: Function, msg: string) => {
    console.log(`${fn.name}(): ${msg}`);
};

const brightnessUp = (oldState: LightState) => {
    const newState = {...oldState};
    // This could use a switch integral division, but this is much clearer...
    if (oldState.brightness > 0) {
        newState.brightness = 85;
    }
    if (oldState.brightness >= 85) {
        newState.brightness = 170;
    }
    if (oldState.brightness >= 170) {
        newState.brightness = 254;
    }

    return newState;
}

const brightnessDown = (oldState: LightState) => {
    const newState = {...oldState};
    // This could use a switch integral division, but this is much clearer...
    if (oldState.brightness > 0) {
        newState.brightness = 85;
    }
    if (oldState.brightness > 85) {
        newState.brightness = 85;
    }
    if (oldState.brightness > 170) {
        newState.brightness = 170;
    }

    return newState;
}

const toggleLights = (client: MQTT.AsyncMqttClient, _action: Action) => {
    tradfri.send({
        type: "set",
        state: "toggle",
        warmth: 350,
        brightness: 254,
        "friendly-name": "ikea",
        client
    });
    log(processAction, "Lights toggled.");
};

const changeBrightness = async (client: MQTT.AsyncMqttClient, action: Action) => {
    // This promise serves the purpose of synchronizing everything. I need to wait until I get the response
    // from the subscription.
    await new Promise(async (resolve) => {
        const sub = await tradfri.subscribe({
            client,
            subType: "light",
            "friendly-name": "ikea",
            callback: async (state) => {
                // Need an IIFE here, so that the promise always gets resolved
                (async () => {
                    sub.unsubscribe();
                    if (state.state === "OFF") {
                        log(processAction, "Light is off, not doing anything.");
                        return;
                    }

                    const newState = action === Action.BrightnessUp ? brightnessUp(state) : brightnessDown(state);
                    if (newState.brightness === state.brightness) {
                        log(processAction, `Brightness is already at ${newState.brightness}, not doing anything.`);
                        return;
                    }

                    await tradfri.send({
                        type: "set",
                        client,
                        "friendly-name": "ikea",
                        ...newState
                    });
                    log(processAction, `Changing brightness to ${newState.brightness}.`);
                })();
                resolve();
            }
        });
        tradfri.send({
            type: "get",
            "friendly-name": "ikea",
            client
        });
    });
}


const processAction = async (client: MQTT.AsyncMqttClient, action: Action) => {
    switch (action) {
        case Action.Toggle:
            toggleLights(client, action);
            break;
        case Action.BrightnessUp:
        case Action.BrightnessDown:
            changeBrightness(client, action);
            break;

        default:
            log(processAction, `Ignoring '${action}'.`);
            break;
    }
};

const main = async () => {
    log(main, "Connecting to the broker...");
    const client = await tradfri.createClient(args["broker-address"]);
    log(main, "Connected.");
    const subTo = args["remote-name"];
    log(main, `Subscribing to '${subTo}'...`);
    await tradfri.subscribe({
        client,
        "friendly-name": subTo,
        subType: "remote",
        callback: async (action: Action) => {
            log(main, `Processing '${action}'...`);
            await processAction(client, action);
            log(main, `Processing '${action}' done.`);
        }
    });
    log(main, "Subscribed.");
    log(main, "Listening for events...");
};


main();
