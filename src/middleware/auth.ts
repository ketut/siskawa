import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access' });
    }

    // Here you would typically verify the token (e.g., using JWT)
    // For demonstration, we'll assume the token is valid if it equals 'valid-token'
    if (token === 'valid-token') {
        next();
    } else {
        return res.status(403).json({ message: 'Forbidden' });
    }
};