import yargs from "yargs"
import MQTT from "async-mqtt"
import log from "./log"
import tradfri, {Action, LightLevels, LightState} from "./lib"
import ringPhone from "./ring_phone"

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

const getLevel = (state: LightState): 0 | 1 | 2 => {
    if (state.brightness <= LightLevels[0].brightness) {
        return 0;
    }
    if (state.brightness <= LightLevels[1].brightness) {
        return 1;
    }
    return 2;
};

const toggleLights = (client: MQTT.AsyncMqttClient, _action: Action) => {
    tradfri.send({
        type: "set",
        state: "toggle",
        color_temp: 350,
        brightness: 254,
        "friendly-name": "ikea",
        client
    });
    log(processAction, "Lights toggled.");
};

const changeBrightness = async (client: MQTT.AsyncMqttClient, action: Action.BrightnessUp | Action.BrightnessDown) => {
    // This promise serves the purpose of synchronizing everything. I need to wait until I get the response
    // from the subscription.
    await new Promise<void>(async (resolve) => {
        const sub = await tradfri.subscribe({
            client,
            subType: "light",
            "friendly-name": "ikea",
            callback: (state) => {
                // Need an IIFE here, so that the promise always gets resolved
                (async () => {
                    sub.unsubscribe();
                    let newLevel;
                    if (state.state === "OFF") {
                        log(changeBrightness, "Light is off.");
                        // Disable light_resetter
                        await tradfri.send({
                            client,
                            type: "tradfri",
                            msg: "supress-next",
                            "friendly-name": "light-resetter"
                        });
                        newLevel = 0;
                    } else {
                        const currentLevel = getLevel(state);
                        if (
                            (action === Action.BrightnessDown && currentLevel === 0) ||
                            (action === Action.BrightnessUp && currentLevel === 2)
                        ) {
                            log(changeBrightness, `Brightness is already at level ${currentLevel}, not doing anything.`);
                            return;
                        }

                        newLevel = action === Action.BrightnessUp ? currentLevel + 1 : currentLevel - 1
                    }

                    log(changeBrightness, `Changing brightness to level ${newLevel} (brightness: ${LightLevels[newLevel].brightness}, temp: ${LightLevels[newLevel].color_temp}).`);
                    tradfri.send({
                        type: "set",
                        client,
                        "friendly-name": "ikea",
                        ...LightLevels[newLevel]
                    });
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
            await changeBrightness(client, action);
            break;
        case Action.BrightnessUpHold:
            ringPhone();
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
