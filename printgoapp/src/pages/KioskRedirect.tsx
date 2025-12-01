import { useNavigate, useSearchParams } from "react-router-dom";

const KioskRedirect = () => {
  const [searchParams] = useSearchParams();
  const userSessionNumber = searchParams.get("userSessionNumber");
  localStorage.setItem("userSessionNumber", userSessionNumber || "");
  const navigate = useNavigate();
  setTimeout(() => {
    navigate("/upload");
  }, 2000);

  return <div>Welcome, Please wait while connecting...</div>;
};

export default KioskRedirect;
