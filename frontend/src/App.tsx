import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import XmlImport from "./pages/XmlImport";
import MedicalCases from "./pages/MedicalCases";
import Checks from "./pages/Checks";
import Doctors from "./pages/Doctors";
import Catalog from "./pages/Catalog";
import Account from "./pages/Account";
import Login from "./pages/Login";
import StaffSchedules from "./pages/StaffSchedules";

import Machines from "./pages/CataLog/Machines";
import Services from "./pages/CataLog/Services";
import Departments from "./pages/CataLog/Departments";
import MedicalStaff from "./pages/CataLog/MedicalStaff";
import Drugs from "./pages/CataLog/Drugs";
import ExaminationServices from "./pages/CataLog/ExaminationServices";
import ServiceDiagnosis from "./pages/CataLog/ServiceDiagnosis";
import ServiceStaff from "./pages/CataLog/ServiceStaff";
import IcdWarnings from "./pages/CataLog/IcdWarnings";
import EntForeignBody from "./pages/CataLog/EntForeignBody";
import ServiceCalciumElectrolyte from "./pages/CataLog/ServiceCalciumElectrolyte";
import ServiceChestXray from "./pages/CataLog/ServiceChestXray";
import ServiceIcdRules from "./pages/CataLog/ServiceIcdRules";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import DrugIcdInteractions from "./pages/CataLog/DrugIcdInteractions";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/xml-import" element={<XmlImport />} />
          <Route path="/medical-cases" element={<MedicalCases />} />
          <Route path="/checks" element={<Checks />} />
          <Route path="/schedule" element={<StaffSchedules />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/account" element={<Account />} />

          <Route element={<AdminRoute />}>
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/machines" element={<Machines />} />
            <Route path="/catalog/services" element={<Services />} />
            <Route path="/catalog/service-diagnosis" element={<ServiceDiagnosis />} />
            <Route path="/catalog/service-icd" element={<ServiceIcdRules />} />
            <Route path="/catalog/service-staff" element={<ServiceStaff />} />
            <Route path="/catalog/examination-services" element={<ExaminationServices />} />
            <Route path="/catalog/departments" element={<Departments />} />
            <Route path="/catalog/medical-staff" element={<MedicalStaff />} />
            <Route path="/catalog/drugs" element={<Drugs />} />
            <Route
  path="/catalog/drug-icd-interactions"
  element={<DrugIcdInteractions />}
/>
          </Route>

          {/* Giữ nguyên phạm vi quyền truy cập của các route cũ */}
          <Route path="/catalog/icd-warnings" element={<IcdWarnings />} />
          <Route path="/catalog/ent-foreign-body" element={<EntForeignBody />} />
          <Route path="/catalog/service-calcium-electrolyte" element={<ServiceCalciumElectrolyte />} />
          <Route path="/catalog/service-chest-xray" element={<ServiceChestXray />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
