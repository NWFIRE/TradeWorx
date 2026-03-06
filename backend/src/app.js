import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import adminRoutes from './api/adminRoutes.js';
import reportRoutes from './api/reportRoutes.js';
import notificationRoutes from './api/notificationRoutes.js';
import authRoutes from './api/authRoutes.js';

import clientRoutes from './api/clientRoutes.js';
import propertyRoutes from './api/propertyRoutes.js';
import userRoutes from './api/userRoutes.js';
import userProfileRoutes from './api/userProfileRoutes.js';
import inspectionRoutes from './api/inspectionRoutes.js';
import deficiencyRoutes from './api/deficiencyRoutes.js';
import fireExtinguisherRoutes from './api/fireExtinguisherRoutes.js';

import emergencyLightReportRoutes from './api/emergencylightreportRoutes.js';
import fireAlarmReportRoutes from './api/firealarmreportRoutes.js';
import wetChemicalReportRoutes from './api/wetchemicalreportRoutes.js';
import wetSprinklerReportRoutes from './api/wetsprinklerreportRoutes.js';
import workOrderRoutes from './api/workorderRoutes.js';
import workOrderDeficiencyRoutes from './api/workorderdeficiencyRoutes.js';

export const createApp = () => {
    const app = express();

    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    }));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    app.use((req, res, next) => {
        logger.info(`${req.method} ${req.url}`);
        next();
    });

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', message: 'NW FIRE Mobile API' });
    });

    // Mount Custom REST functionality
    app.use('/api/auth', authRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/properties', propertyRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/user-profiles', userProfileRoutes);
    app.use('/api/inspections', inspectionRoutes);
    app.use('/api/deficiencies', deficiencyRoutes);
    app.use('/api/fire-extinguishers', fireExtinguisherRoutes);
    app.use('/api/emergency-light-reports', emergencyLightReportRoutes);
    app.use('/api/fire-alarm-reports', fireAlarmReportRoutes);
    app.use('/api/wet-chemical-reports', wetChemicalReportRoutes);
    app.use('/api/wet-sprinkler-reports', wetSprinklerReportRoutes);
    app.use('/api/work-orders', workOrderRoutes);
    app.use('/api/work-order-deficiencies', workOrderDeficiencyRoutes);

    // Mount Converted Base44 Functions (e.g. PDF generation)
    app.use('/api/functions', adminRoutes);
    app.use('/api/functions', reportRoutes);
    app.use('/api/functions', notificationRoutes);

    app.use(errorHandler);

    return app;
};
