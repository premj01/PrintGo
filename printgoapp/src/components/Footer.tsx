import React from "react";

const Footer = () => {
  return (
    <footer style={{backgroundColor: '#A0C878'}} className="text-theme-text py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm">&copy; 2023 PrintGo. All rights reserved.</p>
        <p className="text-xs mt-2 text-theme-textLight">Designed for mobile browsers.</p>
      </div>
    </footer>
  );
};

export default Footer;