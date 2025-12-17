import { render, screen } from '@testing-library/react'
import Home from '@/pages/index'

describe('Home page', () => {
  it('renders hero content', () => {
    render(<Home />)
    expect(screen.getByText(/Music Stream/i)).toBeInTheDocument()
    const broadcastLink = screen.getByRole('link', { name: /Start Broadcasting/i })
    expect(broadcastLink).toBeInTheDocument()
    expect(broadcastLink).toHaveAttribute('href', '/broadcast')

    const joinLink = screen.getByRole('link', { name: /Join Room/i })
    expect(joinLink).toBeInTheDocument()
    expect(joinLink).toHaveAttribute('href', '/browse')

    expect(screen.queryByText(/Spotify/i)).not.toBeInTheDocument()
  })
})
