using System.Text;
using Audibly.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(builder.Configuration["Cors:AllowedOrigins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? ["http://localhost:3000"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Supabase JWT validation (use JWT secret from Supabase: Project Settings -> API -> JWT Secret)
var supabaseJwt = builder.Configuration.GetSection("Supabase:Jwt");
var jwtSecret = supabaseJwt["Secret"];
var validIssuer = supabaseJwt["Issuer"] ?? "https://your-project.supabase.co/auth/v1";

if (!string.IsNullOrEmpty(jwtSecret))
{
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = validIssuer,
                ValidateAudience = true,
                ValidAudience = "authenticated",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                RequireSignedTokens = false,
                SignatureValidator = (token, _) => new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(token)
            };
        });
}

builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IStreamTokenService, StreamTokenService>();
builder.Services.Configure<LocalCatalogOptions>(builder.Configuration.GetSection(LocalCatalogOptions.SectionName));
builder.Services.Configure<OneDriveOptions>(builder.Configuration.GetSection(OneDriveOptions.SectionName));

var localRoot = builder.Configuration[LocalCatalogOptions.SectionName + ":RootPath"];
if (!string.IsNullOrWhiteSpace(localRoot))
{
    builder.Services.AddScoped<ICatalogService, LocalCatalogService>();
}
else
{
    builder.Services.AddScoped<IOneDriveService, OneDriveService>();
    builder.Services.AddScoped<ICatalogService, CatalogService>();
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
