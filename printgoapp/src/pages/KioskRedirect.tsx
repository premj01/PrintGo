import { useNavigate, useSearchParams } from "react-router-dom";

const KioskRedirect = () => {
  const [searchParams] = useSearchParams();
  const userSessionNumber = searchParams.get("userSessionNumber");
  localStorage.setItem("userSessionNumber", userSessionNumber || "");
  const navigate = useNavigate();
  setTimeout(() => {
    navigate("/upload");
  }, 2000);

  return (
    <div className="p-4 flex items-center justify-center min-h-[50vh] bg-theme-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4 text-theme-text">Welcome</h1>
        <p className="text-theme-textLight">Please wait while connecting...</p>
      </div>
    </div>
  );
};

export default KioskRedirect;
