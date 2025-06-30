import { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';

interface LogRequest extends Request {
  startTime?: number;
}

export const logger = (req: LogRequest, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';
  
  // Log request start
  console.log(chalk.cyan(`📥 ${method} ${url}`), chalk.gray(`- ${ip}`));
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - (req.startTime || Date.now());
    const { statusCode } = res;
    
    let statusColor = chalk.green; // 2xx
    if (statusCode >= 400 && statusCode < 500) {
      statusColor = chalk.yellow; // 4xx
    } else if (statusCode >= 500) {
      statusColor = chalk.red; // 5xx
    }
    
    console.log(
      chalk.cyan(`📤 ${method} ${url}`),
      statusColor(`${statusCode}`),
      chalk.gray(`- ${duration}ms - ${ip}`)
    );
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(chalk.yellow(`⚠️ Slow request: ${method} ${url} took ${duration}ms`));
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    
    const logData = {
      method,
      url: originalUrl,
      statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (e.g., Winston, ELK stack)
      console.log(JSON.stringify(logData));
    }
  });
  
  next();
};