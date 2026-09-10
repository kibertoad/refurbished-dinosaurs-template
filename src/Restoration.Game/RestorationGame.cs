using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace Restoration.Game;

public sealed class RestorationGame : Microsoft.Xna.Framework.Game
{
    private readonly bool _platformSmoke;
    private readonly GraphicsDeviceManager _graphics;

    public RestorationGame(bool platformSmoke = false)
    {
        _platformSmoke = platformSmoke;
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = 960,
            PreferredBackBufferHeight = 540
        };
        IsMouseVisible = true;
        Window.Title = "{{DISPLAY_NAME}}";
    }

    protected override void Initialize()
    {
        base.Initialize();
        if (_platformSmoke) Exit();
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(20, 24, 32));
        base.Draw(gameTime);
    }
}
