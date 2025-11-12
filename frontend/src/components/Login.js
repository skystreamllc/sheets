import React, { useState } from 'react';
import './Login.css';
import api from '../services/api';

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const data = await api.login({ username, password });
        api.setAuthToken(data.tokens.access);
        onLogin(data.user);
      } else {
        const data = await api.register({ username, password, email });
        api.setAuthToken(data.tokens.access);
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Произошла ошибка');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isLogin ? 'Вход' : 'Регистрация'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {!isLogin && (
            <input
              type="email"
              placeholder="Email (необязательно)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit">{isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
        <button
          className="toggle-mode"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  );
}

export default Login;

