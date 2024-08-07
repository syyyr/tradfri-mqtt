import MQTT from "async-mqtt";
type MQTTVars = {
    "friendly-name": string;
    client: MQTT.AsyncMqttClient;
};

// FIXME: output state can't be toggle
// FIXME: if state is toggle, then brightness and warmth don't count
type LightState = {
    brightness: number;
    state: "ON" | "OFF" | "toggle";
    color_temp: number;
}

type SendArgs = MQTTVars & (
    ({type: "set"} & LightState) |
    ({type: "plug"}) |
    {type: "get"} |
    ({type: "tradfri"} & {msg: string})
);
type SubscribeArgs = MQTTVars & ({
    subType: "remote";
    callback: (action: ActionType) => void;
} | {
    subType: "light";
    callback: (state: LightState) => void;
} | {
    subType: "announce";
    callback: () => void;
} | {
    subType: "tradfri";
    callback: (msg: string) => void;
});

enum ActionType {
    Toggle = "toggle",
    // WARNING: don't use this one, because it always fires after Toggle and there's no "release event"
    __ToggleHold = "toggle_hold",
    Left = "arrow_left_click",
    Right = "arrow_right_click",
    BrightnessUp = "brightness_up_click",
    BrightnessDown = "brightness_down_click",
    ArrowLeftHold = "arrow_left_hold",
    ArrowLeftRelease = "arrow_left_release",
    ArrowRightHold = "arrow_right_hold",
    ArrowRightRelease = "arrow_right_release",
    BrightnessUpHold = "brightness_move_up",
    BrightnessDownHold = "brightness_move_down",
    BrightnessRelease ="brightness_stop",
    On ="on",
    Off ="off",
};

type Announce = {
    message: "announce";
    meta: {
        friendly_name: string;
    };
    type: "device_announced";
}

type RemotePayload = {
    battery: number,
    linkquality: number
    update: {
        state: string
    }
    update_available: boolean,
    action?: ActionType
}

const isRemotePayload = (toCheck: any): toCheck is RemotePayload => {
    return typeof toCheck === "object" &&
        typeof toCheck.battery === "number" &&
        typeof toCheck.linkquality === "number" &&
        typeof toCheck.action === "string";
}

const isAction = (toCheck: any): toCheck is ActionType => {
    return typeof toCheck === "string" && Object.values(ActionType).includes(toCheck as ActionType);
};

const isLightState = (toCheck: Object): toCheck is LightState => {
    return typeof (toCheck as LightState).state !== "undefined";
};

const isAnnounce = (toCheck: Object): toCheck is Announce => {
    const announceObj = toCheck as Announce;
    return announceObj.message === "announce" &&
        announceObj.type === "device_announced" &&
        typeof announceObj.meta === "object" &&
        typeof announceObj.meta.friendly_name === "string";
}

const createClient = (brokerAddress: string) => {
    return MQTT.connectAsync(`tcp://${brokerAddress}`);
};

const send = async (input: SendArgs) => {
    let message = {};
    switch (input.type) {
        case "set":
            if (input.brightness > 254 || input.brightness < 0) {
                console.error("Brightness must be within 0 and 254");
                process.exit(1);
            }
            message = {
                brightness: input.brightness,
                state: input.state,
                color_temp: input.color_temp
            };
            break;
        case "plug":
            message = {
                state: "TOGGLE"
            };
            break;
        case "get":
            message = {
                state: ""
            };
            break;
        case "tradfri":
            message = input.msg;
            break;
    }

    const topic = (() => {
        switch (input.type) {
            case "get":
            case "set":
                return `zigbee2mqtt/${input["friendly-name"]}/${input.type}`;
            case "plug":
                return `zigbee2mqtt/${input["friendly-name"]}/set`;
            case "tradfri":
                return `tradfri/${input["friendly-name"]}`;
        }
    })();

    await input.client.publish(topic, JSON.stringify(message));
};

const convertSubType = (input: SubscribeArgs["subType"], friendlyName: SubscribeArgs["friendly-name"]): string => {
    switch (input) {
        case "remote":
            return `zigbee2mqtt/${friendlyName}`;
        case "light":
            return `zigbee2mqtt/${friendlyName}`;
        case "announce":
            return `zigbee2mqtt/bridge/log`;
        case "tradfri":
            return `tradfri/${friendlyName}`;
    }
};

const subscribe = async (input: SubscribeArgs) => {
    const userTopic = `${convertSubType(input.subType, input["friendly-name"])}`;

    const callback = (topic: string, msg: Buffer) => {
        if (topic === userTopic) {
            const msgString = msg.toString();
            switch (input.subType) {
                case "remote":
                    let actionObj;
                    try {
                        actionObj = JSON.parse(msgString);
                    } catch (err) {
                        break;
                    }
                    if (isRemotePayload(actionObj)) {
                        if (isAction(actionObj.action)) {
                            input.callback(actionObj.action);
                        }
                        return;
                    }
                    break;
                case "light":
                    let lightStateObj;
                    try {
                        lightStateObj = JSON.parse(msgString);
                    } catch (err) {
                        break;
                    }

                    if (isLightState(lightStateObj)) {
                        input.callback(lightStateObj);
                        return;
                    }
                    break;
                case "announce":
                    let announceObj;
                    try {
                        announceObj = JSON.parse(msgString);
                    } catch (err) {
                        break;
                    }

                    if (isAnnounce(announceObj)) {
                        input.callback();
                    }
                    // Ignore other non-announce stuff
                    return;
                case "tradfri":
                    let msg;
                    try {
                        msg = JSON.parse(msgString);
                    } catch (err) {
                        break;
                    }
                    if (typeof msg === "string" ) {
                        input.callback(msg);
                        return;
                    }
            }
            throw new Error(`Invalid subtype '${input.subType}' for topic '${userTopic}'. Payload: '${msgString}'`);
        }
    };
    await input.client.subscribe(userTopic);
    input.client.on("message", callback);
    return {
        unsubscribe: () => {
            input.client.unsubscribe(userTopic);
            input.client.removeListener("message", callback);
        }
    }
};


// The levels are as follows:
// 0....1...170...254
//|___0_|___1_|___2_|
const levels: [LightState, LightState, LightState, LightState] = [
    {
        brightness: 2,
        color_temp: 500,
        state: "ON"
    },
    {
        brightness: 150,
        color_temp: 400,
        state: "ON"
    },
    {
        brightness: 254,
        color_temp: 350,
        state: "ON"
    },
    {
        brightness: 254,
        color_temp: 250,
        state: "ON"
    }
];

export {levels as LightLevels, MQTTVars, ActionType as Action, LightState};

export default {
    createClient,
    send,
    subscribe,
};
