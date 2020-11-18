import MQTT from "async-mqtt";
type MQTTVars = {
    "friendly-name": string;
    client: MQTT.AsyncMqttClient;
};

type LightState = {
    brightness: number;
    state: "on" | "off" | "toggle";
    warmth: number;
}

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

type SendInput = MQTTVars & LightState;
type SubscribeInput = MQTTVars & ({
    subType: "remote";
    callback: (action: Action) => void
});

const createClient = (brokerAddress: string) => {
    return MQTT.connectAsync(`tcp://${brokerAddress}`);
};

const send = async (input: SendInput) => {
    if (input.brightness > 254 || input.brightness < 0) {
        console.error("Brightness must be within 0 and 254");
        process.exit(1);
    }
    const message = {
        brightness: input.brightness,
        state: input.state,
        color_temp: input.warmth
    };
    await input.client.publish(`zigbee2mqtt/${input["friendly-name"]}/set`, JSON.stringify(message));
};

const convertSubType = (input: SubscribeInput["subType"]) => {
    switch (input) {
    case "remote":
        return "action";
    }
};

const subscribe = async (input: SubscribeInput) => {
    const userTopic = `zigbee2mqtt/${input["friendly-name"]}/${convertSubType(input.subType)}`;

    const callback = (topic: string, msg: Buffer) => {
        if (topic === userTopic) {
            const msgString = msg.toString();
            switch (input.subType) {
                case "remote":
                    if (isAction(msgString)) {
                        input.callback(msgString);
                        return;
                    }
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

export {MQTTVars, Action};

export default {
    createClient,
    send,
    subscribe,
};
