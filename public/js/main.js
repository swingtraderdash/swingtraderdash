/* main.css — branded base layout */

body {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  background-color: #ffffff;
  color: #333;
}

header {
  background-color: #0a2540;
  color: white;
  padding: 1rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
}

nav {
  background-color: #1e3a5f;
  padding: 0.5rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
}

nav a {
  color: white;
  text-decoration: none;
  font-weight: 500;
}

nav a:hover {
  text-decoration: underline;
}

.container {
  max-width: 960px;
  margin: 2rem auto;
  padding: 1rem;
  background-color: white;
}

/* ✅ Footer styling restored from old site */
footer {
  background-color: #2c3e50;
  color: white;
  text-align: center;
  padding: 0.5em 0;
  font-weight: 600;
  font-size: 0.9em;
}
