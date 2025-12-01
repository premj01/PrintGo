import React, { useEffect, useState } from "react";

const NavbarMain = () => {
  const [user, setuser]: any = useState();
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setuser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <div>
      <span>{user?.name}</span>
      <span>{user?.email}</span>
      {/* <img src={user?.picture} alt="img" /> */}
      Navbar
    </div>
  );
};

export default NavbarMain;
