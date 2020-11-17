import yargs from "yargs"
import mqtt from "async-mqtt"
import tradfri from "./lib"

const _log_internal = console.log;
console.log = () => {throw new Error("Don't use console.log directly, use the log() function");};

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

enum Action {
    Toggle = "toggle",
    Left = "arrow_left_click",
    Right = "arrow_right_click",
    BrightnessDown = "brightness_down_click",
    BrightnessUp = "brightness_up_click"
};

const isAction = (toCheck: string): toCheck is Action => {
    return Object.values(Action).includes(toCheck as Action);
};

const log = (fn: Function, msg: string) => {
    _log_internal(`${fn.name}(): ${msg}`);
};

const processAction = (action: Action) => {
    switch (action) {
        case Action.Toggle:
            log(processAction, "Toggling lights...");
            tradfri({
                state: "toggle",
                warmth: 350,
                brightness: 254,
                "broker-address": args["broker-address"],
                "friendly-name": "ikea"
            });
            log(processAction, "Lights toggled.");
            break;
        case Action.BrightnessUp:
        case Action.BrightnessDown:
        case Action.Left:
        case Action.Right:
            log(processAction, `Ignoring '${action}'.`);
            break;
    }
};

const main = async () => {
    log(main, "Connecting to the broker...");
    const conn = await mqtt.connectAsync(`tcp://${args["broker-address"]}`);
    log(main, "Connected.");
    const topic = `zigbee2mqtt/${args["remote-name"]}/action`;
    log(main, `Subscribing to '${topic}'...`);
    await conn.subscribe(topic);
    log(main, "Subscribed.");
    log(main, "Listening for events...");
    conn.on("message", (_topic: string, payload: Buffer) => {
        const action = payload.toString();
        if (isAction(action)) {
            log(main, `Processing action '${action}'...`);
            processAction(action);
        } else {
            log(main, `Got unknown action '${action}'`);
        }

    });
};


main();
