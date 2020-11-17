import MQTT from "async-mqtt";
interface Input {
    brightness: number;
    state: "on" | "off" | "toggle";
    warmth: number;
    "friendly-name": string;
    "broker-address": string;
};

const impl = async (client: MQTT.AsyncMqttClient, input: Input) => {
    const message = {
        brightness: input.brightness,
        state: input.state,
        color_temp: input.warmth
    };
    try {
        await client.publish(`zigbee2mqtt/${input["friendly-name"]}/set`, JSON.stringify(message));
        await client.end();
    } catch (e){
        console.log(e.stack);
        process.exit();
    }
};

const send = async (input: Input) => {
    if (input.brightness > 254 || input.brightness < 0) {
        console.error("Brightness must be within 0 and 254");
        process.exit(1);
    }
    const client = await MQTT.connectAsync(`tcp://${input["broker-address"]}`);
    impl(client, input);
}

export default {
    send
};
