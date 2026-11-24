/**
 * Utility helper to extract a single real client IP address
 * Resolves BUG-ADM-14: handles X-Forwarded-For with multiple IPs, Express trust proxy, IPv6 format
 */
const getClientIp = (req) => {
    if (!req) return null;
    let ip = null;
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded && typeof forwarded === "string") {
        ip = forwarded.split(",")[0].trim();
    } else if (req.ip) {
        ip = req.ip;
    } else if (req.socket?.remoteAddress) {
        ip = req.socket.remoteAddress;
    }

    if (ip && typeof ip === "string") {
        if (ip.includes(",")) {
            ip = ip.split(",")[0].trim();
        }
        if (ip === "::1" || ip === "::ffff:127.0.0.1") {
            ip = "127.0.0.1";
        } else if (ip.startsWith("::ffff:")) {
            ip = ip.replace("::ffff:", "");
        }
    }
    return ip || null;
};

module.exports = {
    getClientIp
};

