/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Account from './pages/Account';
import ClientDetails from './pages/ClientDetails';
import Clients from './pages/Clients';
import CustomerInspectionDetails from './pages/CustomerInspectionDetails';
import CustomerPortal from './pages/CustomerPortal';
import Dashboard from './pages/Dashboard';
import Deficiencies from './pages/Deficiencies';
import Disabled from './pages/Disabled';
import EmailPreview from './pages/EmailPreview';
import EmergencyLightReport from './pages/EmergencyLightReport';
import FireAlarmReport from './pages/FireAlarmReport';
import FireExtinguisherSurvey from './pages/FireExtinguisherSurvey';
import InspectionDetails from './pages/InspectionDetails';
import Inspections from './pages/Inspections';
import NotAuthorized from './pages/NotAuthorized';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import RecurringInspections from './pages/RecurringInspections';
import Reports from './pages/Reports';
import TechnicianMonthly from './pages/TechnicianMonthly';
import Templates from './pages/Templates';
import Users from './pages/Users';
import WetChemicalReport from './pages/WetChemicalReport';
import WetSprinklerReport from './pages/WetSprinklerReport';
import WorkOrderReport from './pages/WorkOrderReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Account": Account,
    "ClientDetails": ClientDetails,
    "Clients": Clients,
    "CustomerInspectionDetails": CustomerInspectionDetails,
    "CustomerPortal": CustomerPortal,
    "Dashboard": Dashboard,
    "Deficiencies": Deficiencies,
    "Disabled": Disabled,
    "EmailPreview": EmailPreview,
    "EmergencyLightReport": EmergencyLightReport,
    "FireAlarmReport": FireAlarmReport,
    "FireExtinguisherSurvey": FireExtinguisherSurvey,
    "InspectionDetails": InspectionDetails,
    "Inspections": Inspections,
    "NotAuthorized": NotAuthorized,
    "Properties": Properties,
    "PropertyDetails": PropertyDetails,
    "RecurringInspections": RecurringInspections,
    "Reports": Reports,
    "TechnicianMonthly": TechnicianMonthly,
    "Templates": Templates,
    "Users": Users,
    "WetChemicalReport": WetChemicalReport,
    "WetSprinklerReport": WetSprinklerReport,
    "WorkOrderReport": WorkOrderReport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};