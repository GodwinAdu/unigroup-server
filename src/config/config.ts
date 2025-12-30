import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;
    mongodbUrl: string;
    sms_token: string;
}

const config: Config = {
    port: Number(process.env.PORT),
    nodeEnv: process.env.NODE_ENV || 'development',
    sms_token: process.env.SMS_TOKEN!,
    mongodbUrl: process.env.MONGODB_URL!
};

export default config;