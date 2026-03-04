import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "./Layouts/RootLayout";
import { Home } from "./pages/Home";
import Contact from "./pages/Contact";
import LoginGoogle from "./pages/LoginGoogle";
import OAuthCallback from "./pages/oauth-Callback";
import KioskRedirect from "./pages/KioskRedirect";
import Upload from "./pages/Upload";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "auth", element: <LoginGoogle /> },
      { path: "contact", element: <Contact /> },
      { path: "upload", element: <Upload /> },
      { path: "*", element: <div>404 Not Found</div> },
    ],
  },
  { path: "/kisokRedirect", element: <KioskRedirect /> },
  { path: "/oauth-callback", element: <OAuthCallback /> },
]);

function App() {
  return <RouterProvider router={router}></RouterProvider>;
}

export default App;
