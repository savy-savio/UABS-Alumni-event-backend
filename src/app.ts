import express, { Application } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isProduction } from './config/env';
import { API_PREFIX } from './constants';
import routes from './routes';
import { notFoundHandler } from './middleware/notFound';
import emailRoutes from './modules/email/email.routes';
import brevoWebhook from './modules/email/brevo.webhook';
import { errorHandler} from './middleware/errorHandler';

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Requests with no Origin header (curl, server-to-server, health monitors) are allowed.
    if (!origin || env.CLIENT_URL.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const createApp = (): Application => {
  const app = express();

  // Render and most hosts sit behind a proxy.
  if (isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(`${API_PREFIX}/webhooks/brevo`, brevoWebhook);
  app.use(API_PREFIX, routes);
  app.use(API_PREFIX, emailRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
