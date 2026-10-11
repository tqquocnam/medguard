import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";


// ======================================================
// PAGES
// ======================================================

import Dashboard from "./pages/Dashboard";
import XmlImport from "./pages/XmlImport";
import MedicalCases from "./pages/MedicalCases";
import Checks from "./pages/Checks";
import Doctors from "./pages/Doctors";
import Catalog from "./pages/Catalog";
import Account from "./pages/Account";
import Login from "./pages/Login";
import Machines
  from "./pages/CataLog/Machines";

import Services
  from "./pages/CataLog/Services";

  import Departments
  from "./pages/CataLog/Departments";

// ======================================================
// LAYOUT
// ======================================================

import MainLayout from "./layouts/MainLayout";


// ======================================================
// AUTH
// ======================================================

import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";

import MedicalStaff
  from "./pages/CataLog/MedicalStaff";

import Drugs
  from "./pages/CataLog/Drugs";
import ExaminationServices
  from "./pages/CataLog/ExaminationServices";

import StaffSchedules
  from "./pages/StaffSchedules"
import ServiceDiagnosis from "./pages/CataLog/ServiceDiagnosis";


import ServiceStaff
  from "./pages/CataLog/ServiceStaff";


import IcdWarnings
  from "./pages/CataLog/IcdWarnings";

export default function App() {

  return (
    <Routes>

      {/* ================================================= */}
      {/* LOGIN */}
      {/* KHÔNG CẦN ĐĂNG NHẬP */}
      {/* ================================================= */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />


      {/* ================================================= */}
      {/* TẤT CẢ TRANG BÊN DƯỚI PHẢI ĐĂNG NHẬP */}
      {/* ================================================= */}

      <Route
        element={
          <ProtectedRoute />
        }
      >

        <Route
          element={
            <MainLayout />
          }
        >

          {/* ============================================= */}
          {/* DASHBOARD */}
          {/* ============================================= */}

          <Route
            path="/"
            element={
              <Dashboard />
            }
          />


          {/* Đường dẫn cũ */}

          <Route
            path="/dashboard"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />


          {/* ============================================= */}
          {/* XML IMPORT */}
          {/* ============================================= */}

          <Route
            path="/xml-import"
            element={
              <XmlImport />
            }
          />


          {/* ============================================= */}
          {/* DANH SÁCH HỒ SƠ */}
          {/* ============================================= */}

          <Route
            path="/medical-cases"
            element={
              <MedicalCases />
            }
          />


          {/* ============================================= */}
          {/* KIỂM TRA HỒ SƠ */}
          {/* ============================================= */}

          <Route
            path="/checks"
            element={
              <Checks />
            }
          />


          {/* ============================================= */}
          {/* LỊCH TRỰC */}
          {/* ============================================= */}

          <Route
            path="/schedule"
            element={
            <StaffSchedules />
            }
          />


          {/* ============================================= */}
          {/* BÁC SĨ KHÁM */}
          {/* ============================================= */}

          <Route
            path="/doctors"
            element={
              <Doctors />
            }
          />


          {/* ============================================= */}
          {/* TÀI KHOẢN */}
          {/* ADMIN + USER ĐỀU ĐƯỢC VÀO */}
          {/* ============================================= */}

          <Route
            path="/account"
            element={
              <Account />
            }
          />


          {/* ============================================= */}
          {/* CHỈ ADMIN */}
          {/* ============================================= */}

          <Route
            element={
              <AdminRoute />
            }
          >

            {/* =========================================== */}
            {/* DANH MỤC */}
            {/* =========================================== */}

            <Route
              path="/catalog"
              element={
                <Catalog />
              }
            />
            <Route
  path="/catalog/machines"
  element={
    <Machines />
  }
/>

<Route
  path="/catalog/services"
  element={
    <Services />
  }
/>


<Route
  path="/catalog/service-diagnosis"
  element={
    <ServiceDiagnosis />
  }
/>

<Route
  path="/catalog/service-staff"
  element={
    <ServiceStaff />
  }
/>
<Route
  path="/catalog/examination-services"
  element={
    <ExaminationServices />
  }
/>
<Route
  path="/catalog/departments"
  element={
    <Departments />
  }
/>

<Route
  path="/catalog/medical-staff"
  element={
    <MedicalStaff />
  }
/>

<Route
  path="/catalog/drugs"
  element={
    <Drugs />

  
  }
/>
          </Route>

          <Route
  path="/catalog/icd-warnings"
  element={
    <IcdWarnings />
  }
/>


          {/* ============================================= */}
          {/* URL KHÔNG TỒN TẠI */}
          {/* ============================================= */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

        </Route>

      </Route>

    </Routes>
  );
}