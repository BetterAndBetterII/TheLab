import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Home from './pages/Home';
import About from './pages/About';
import Navbar from './components/Navbar';

const { Header, Content, Footer } = Layout;

function App() {
  return (
    <Router>
      <Layout className="layout" style={{ minHeight: '100vh' }}>
        <Header style={{ padding: 0 }}>
          <Navbar />
        </Header>
        <Content style={{ padding: '24px 50px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          TheLab ©{new Date().getFullYear()} Created by Your Name
        </Footer>
      </Layout>
    </Router>
  );
}

export default App;
