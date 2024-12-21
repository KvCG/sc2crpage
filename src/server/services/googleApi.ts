import axios from 'axios';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { Request } from 'express';

dotenv.config();

const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Authenticates with Google API using service account credentials.
 * @returns {Promise<any>} Authenticated client.
 */
const authenticate = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  return authClient;
};

/**
 * Retrieves the access token from the authenticated client.
 * @param {any} auth - Authenticated client.
 * @returns {Promise<string>} Access token.
 */
const getAccessToken = async (auth: any) => {
  const token = await auth.getAccessToken();
  return token.token;
};

/**
 * Retrieves or creates a folder in Google Drive.
 * @param {any} auth - Authenticated client.
 * @param {string} folderName - Name of the folder.
 * @returns {Promise<string>} Folder ID.
 */
const getOrCreateFolder = async (auth: any, folderName: string) => {
  const drive = google.drive({ version: 'v3', auth });

  // Check if the folder already exists
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  // If the folder exists, return its ID
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  } else {
    // If the folder does not exist, create it
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    return folder.data.id;
  }
};

/**
 * Makes a file publicly accessible.
 * @param {string} fileId - ID of the file.
 * @param {any} auth - Authenticated client.
 */
const makeFilePublic = async (fileId: string, auth: any) => {
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
};

/**
 * Retrieves all files from a specified folder in Google Drive.
 * @param {string} folderId - ID of the folder.
 * @param {string} accessToken - Access token.
 * @returns {Promise<Array>} List of files.
 */
const getFilesFromFolder = async (folderId: string, accessToken: string) => {
  const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 100,
      fields: 'files(id, name, mimeType, modifiedTime, size, webContentLink, properties)',
      orderBy: 'name',
    },
  });

  // Map the response data to include custom properties
  return response.data.files.map((file: any) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: file.size,
    downloadUrl: file.webContentLink,
    player1Race: file.properties?.player1Race || '',
    player2Race: file.properties?.player2Race || '',
    description: file.properties?.description || '',
  }));
};

/**
 * Retrieves all replays from the 'ReplaysStarcraft2' folder in Google Drive.
 * @returns {Promise<Array>} List of replays.
 */
export const getAllReplays = async () => {
  try {
    const auth = await authenticate(); // Authenticate with Google API
    const accessToken = await getAccessToken(auth); // Get access token
    const folderId = await getOrCreateFolder(auth, 'ReplaysStarcraft2'); // Get or create the folder
    return await getFilesFromFolder(folderId, accessToken); // Retrieve files from the folder
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Google Drive API error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
    return [];
  }
};

/**
 * Uploads a file to a specified folder in Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @param {string} folderId - ID of the folder.
 * @param {string} accessToken - Access token.
 * @returns {Promise<string>} Uploaded file ID.
 */
const uploadFileToFolder = async (req: Request, folderId: string, accessToken: string) => {
  const { fileBase64, fileName, player1Race, player2Race, description } = req.body;

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
    properties: {
      player1Race,
      player2Race,
      description,
    },
  };

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: application/octet-stream\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    fileBase64 +
    closeDelimiter;

  const response = await axios.post(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    multipartRequestBody,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
    }
  );

  return response.data.id;
};

/**
 * Uploads a replay file to the 'ReplaysStarcraft2' folder in Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @returns {Promise<string|null>} Uploaded file ID or null if an error occurred.
 */
export const uploadReplay = async (req: Request) => {
  try {
    const auth = await authenticate(); // Authenticate with Google API
    const accessToken = await getAccessToken(auth); // Get access token
    const folderId = await getOrCreateFolder(auth, 'ReplaysStarcraft2'); // Get or create the folder
    const fileId = await uploadFileToFolder(req, folderId, accessToken); // Upload the file to the folder
    await makeFilePublic(fileId, auth); // Make the file publicly accessible
    return fileId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Google Drive API error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
    return null;
  }
};

/**
 * Deletes a file from Google Drive.
 * @param {string} fileId - ID of the file to delete.
 * @returns {Promise<boolean>} - Returns true if the deletion was successful, false otherwise.
 */
export const deleteReplay = async (fileId: string): Promise<boolean> => {
    try {
      const auth = await authenticate(); // Authenticate with Google API
      const drive = google.drive({ version: 'v3', auth }); // Get Google Drive instance
      await drive.files.delete({ fileId }); // Delete the file
      return true; // Return true if deletion was successful
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Google Drive API error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
      return false; // Return false if there was an error
    }
  };