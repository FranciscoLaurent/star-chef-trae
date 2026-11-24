import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import LineagePage from './pages/LineagePage';
import ChefDetailPage from './pages/ChefDetailPage';
import JobsPage from './pages/JobsPage';
import AssistantPage from './pages/AssistantPage';
import CommunityPage from './pages/CommunityPage';
import { useData } from './lib/useData';

export default function App() {
  // 页脚统计与全站同一数据源（useData 全局缓存），不再硬编码数字
  // meta.total 本身即真实档案数（不含 275 条待补占位），直接使用
  const { data } = useData();
  return (
    <>
      <NavBar />
      <main className="page-enter">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lineage" element={<LineagePage />} />
          <Route path="/chef/:id" element={<ChefDetailPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      <footer>
        <div className="foot-grid">
          <div className="brand">
            星厨 <em>传承</em>
            <p>以师承关系为信任底层的厨师专属职业平台。记录手艺出处，连接就业机会。</p>
          </div>
          <div>
            <h6>核心功能</h6>
            <ul>
              <li>数字师承谱</li>
              <li>智能招聘匹配</li>
              <li>厨师交流社区</li>
              <li>AI 求职助手</li>
            </ul>
          </div>
          <div>
            <h6>服务群体</h6>
            <ul>
              <li>酒店厨师</li>
              <li>社会餐饮厨师</li>
              <li>私厨与烹饪学员</li>
              <li>餐厅与酒店雇主</li>
            </ul>
          </div>
          <div>
            <h6>数据说明</h6>
            <ul>
              <li>{data ? `${data.meta.total.toLocaleString()} 位真实厨师档案` : '厨师档案整理中'}</li>
              {data && <li>{data.meta.cuisines} 个菜系 · {data.meta.schools} 个门第</li>}
              <li>师承关系来源于公开资料</li>
              <li>岗位数据为演示数据</li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <div>
            <div>© 2026 星厨传承 · 参赛作品</div>
            <div style={{ marginTop: 4 }}>Built with TRAE · 星厨传承以 TRAE 对话式构建</div>
          </div>
          <div>Designed with Fraunces, Instrument Sans &amp; JetBrains Mono</div>
          <div><a href="#top">Back to top ↑</a></div>
        </div>
      </footer>
    </>
  );
}
