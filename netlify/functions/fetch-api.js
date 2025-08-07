exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed. Use POST.'
            })
        };
    }

    try {
        // Parse request body
        const { url, token } = JSON.parse(event.body || '{}');

        // Validate required parameters
        if (!url) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'URL parameter is required',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid URL format',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Build request headers
        const requestHeaders = {
            'Accept': 'application/json',
            'User-Agent': 'Netlify-API-Fetcher/1.0'
        };

        // Add authorization header if token is provided
        if (token && token.trim()) {
            requestHeaders['Authorization'] = `Bearer ${token.trim()}`;
        }

        console.log(`Fetching: ${url}`);

        // Make the external API request
        const response = await fetch(url, {
            method: 'GET',
            headers: requestHeaders,
            timeout: 30000 // 30 second timeout
        });

        // Parse response data
        let data;
        const contentType = response.headers.get('content-type') || '';

        try {
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
                // Try to parse as JSON if it looks like JSON
                if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        // Keep as text if JSON parsing fails
                    }
                }
            }
        } catch (e) {
            data = `Error parsing response: ${e.message}`;
        }

        // Return successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                status: response.status,
                statusText: response.statusText,
                url: url,
                data: data,
                contentType: contentType,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('API Fetch Error:', error);

        // Handle different types of errors
        let errorMessage = error.message;
        let statusCode = 500;

        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout - API took too long to respond';
            statusCode = 504;
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Unable to connect to the API endpoint';
            statusCode = 502;
        }

        return {
            statusCode: statusCode,
            headers,
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};