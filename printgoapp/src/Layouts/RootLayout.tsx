import React from "react";
import { Outlet } from "react-router-dom";
import NavbarMain from "../components/NavbarMain";
import Footer from "../components/Footer";

const RootLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-theme-background">
      <NavbarMain />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default RootLayout;
