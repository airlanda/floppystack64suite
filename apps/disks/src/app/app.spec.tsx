import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './app';

describe('Disks remote', () => {
  it('renders remote heading', () => {
    const { getByText } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(getByText(/First FloppyStack vertical slice/i)).toBeTruthy();
  });
});
