

const Joi = require('joi');
const clientService = require('../services/client.service');
const { sendResponse } = require('../utils/responseHandler');
const { sendEmail } = require('../utils/mailUtil');
const { setCache, getCache, deleteCache } = require('../utils/redisUtil');
const { generateOTP, convertDateTimeToYYYYMMDDHHMMSS } = require('../utils/commonUtil');

const sendMessage = async (req, res) => {
    try {
        const body = req.body;

        const validator = Joi.object({
            firstName: Joi.string().required(),
            lastName: Joi.any().required(),
            email: Joi.string().email().required(),
            phone: Joi.string().required(),
            companyName: Joi.string().required(),
            country: Joi.string().required(),
            jobTitle: Joi.string().required(),
            jobDetails: Joi.string().required(),
        })

        const {error} = validator.validate(body);

        sendEmail(body.email, "AI Solution: Message Received", "Thank you for reaching out to us. We will get back to you as soon as possible!", "");

        if (error) throw new Error("Bad Request")
        const messageData = clientService.sendMessage(body);
    
        sendResponse(res, 200, "Message Sent!", messageData);
    } catch (e) {
        console.log(e)
        sendResponse(res, 400, e.message, null)
    }
}

const getVerificationCodeForEmail = async (req, res) => {
    try {
        const body = req.body;

        const validator = Joi.object({
            email: Joi.string().email().required(),
        })

        const {error} = validator.validate(body);

        if (error) throw new Error("Invalid Email!");

        const OTP = generateOTP();
        console.log("OTP:", OTP);

        setCache(`OTP${body.email}`, { otp: OTP, exp: convertDateTimeToYYYYMMDDHHMMSS(Date.now() + 300000) }); // 5 minutes
        await sendEmail(body.email, "AI Solution: Email Verification", `Your verification code is ${OTP}, Only valid for 5 minutes.`, "");

        sendResponse(res, 200, 'Email sent successfully', OTP);
    } catch (e) {
        sendResponse(res, 400, e.message, null)
    }
}

const verifyEmail = async (req, res) => {
    try {
        const body = req.body;

        const validator = Joi.object({
            email: Joi.string().email().required(),
            otp: Joi.string().required(),
        })

        const {error} = validator.validate(body);

        if (error) throw new Error("Bad Request!");

        const emailToVerify = await getCache(`OTP${body.email}`);
        console.log("mail", emailToVerify, body)

        if (emailToVerify.otp != body.otp) {
            sendResponse(res, 400, 'Wrong OTP', null);
            return;
        }

        if (convertDateTimeToYYYYMMDDHHMMSS(Date.now()) > emailToVerify.exp) {
            sendResponse(res, 400, 'OTP Expired', null);
            return;
        }

        await deleteCache(`OTP${body.email}`);
        await setCache(`VERIFIED${body.email}`, true);

        sendResponse(res, 200, 'Email verified successfully', null);
    } catch (e) {
        sendResponse(res, 400, e.message, null)
    }
}

module.exports = {
    sendMessage,
    getVerificationCodeForEmail,
    verifyEmail,
}