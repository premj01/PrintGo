import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./pages/Home";
import Contact from "./pages/Contact";
import LoginGoogle from "./pages/LoginGoogle";
import OAuthCallback from "./pages/oauth-Callback";
import KioskRedirect from "./pages/KioskRedirect";
import Upload from "./pages/Upload";

const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, element: <Home /> },
      { path: "auth", element: <LoginGoogle /> },
      { path: "contact", element: <Contact /> },
      { path: "*", element: <div>404 Not Found</div> },
    ],
  },
  { path: "/kisokRedirect", element: <KioskRedirect /> },
  { path: "/oauth-callback", element: <OAuthCallback /> },
  { path: "/upload", element: <Upload /> },
]);

function App() {
  return <RouterProvider router={router}></RouterProvider>;
}

export default App;
