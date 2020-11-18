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
    warmth: number;
}

type SendArgs = MQTTVars & ((LightState & {type: "set"}) | {type: "get"});
type SubscribeArgs = MQTTVars & ({
    subType: "remote";
    callback: (action: Action) => void;
} | {
    subType: "light";
    callback: (state: LightState) => void;
});

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

const isLightState = (toCheck: Object): toCheck is LightState => {
    return typeof (toCheck as LightState).state !== "undefined";
};

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
                color_temp: input.warmth
            };
            break;
        case "get":
            message = {
                state: ""
            }
            break;
    }

    await input.client.publish(`zigbee2mqtt/${input["friendly-name"]}/${input.type}`, JSON.stringify(message));
};

const convertSubType = (input: SubscribeArgs["subType"]): string => {
    switch (input) {
        case "remote":
            return "/action";
        case "light":
            return "";
    }
};

const subscribe = async (input: SubscribeArgs) => {
    const userTopic = `zigbee2mqtt/${input["friendly-name"]}${convertSubType(input.subType)}`;

    const callback = (topic: string, msg: Buffer) => {
        if (topic === userTopic) {
            const msgString = msg.toString();
            switch (input.subType) {
                case "remote":
                    if (isAction(msgString)) {
                        input.callback(msgString);
                        return;
                    }
                    break;
                case "light":
                    let obj;
                    try {
                        obj = JSON.parse(msgString);
                    } catch (err) {
                        break;
                    }

                    if (isLightState(obj)) {
                        input.callback(obj);
                        return;
                    }
                    break;
            }
            throw new Error(`Invalid subtype '${input.subType}' for topic '${userTopic}'`);
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

export {MQTTVars, Action, LightState};

export default {
    createClient,
    send,
    subscribe,
};
