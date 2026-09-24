import { useEffect, useState } from "react";
import Player from "./Player.jsx";
import Admin from "./Admin.jsx";

// Players use "/", the organizer uses "/#/admin".
export default function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const h = () => setRoute(location.hash);
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  return route.startsWith("#/admin") ? <Admin /> : <Player />;
}
