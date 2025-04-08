import axios from 'axios';
import dotenv from 'dotenv'

dotenv.config()

const API_BASE_URL = process.env.REPLAY_ANALYZER_URL

/**
 * Analyze a replay using Base64 encoded data.
 * @param {string} fileBase64 - The Base64 encoded replay file.
 * @returns {Promise<any>} The replay analysis result.
 */
export const analyzeReplayBase64 = async (fileBase64: string): Promise<any> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/analyzeReplayBase64`, {
            file_base64: fileBase64,
        });
        return response.data;
    } catch (error) {
        console.error('Error analyzing replay (Base64)');
        return {};
    }
};

/**
 * Analyze a replay using a URL.
 * @param {string} fileUrl - The URL of the replay file.
 * @returns {Promise<any>} The replay analysis result.
 */
export const analyzeReplayUrl = async (fileUrl: string): Promise<any> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/analyzeReplayUrl`, {
            file_url: fileUrl,
        });
        return response.data;
    } catch (error) {
        console.error('Error analyzing replay (URL)');
        return {}
    }
};