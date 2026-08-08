import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { site } from '../data'
import Seo, { breadcrumbJsonLd } from '../components/Seo'
import { fetchRecipeBySlug } from '../lib/recipesApi'

export default function RecipeDetail() {
  const { slug } = useParams()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const data = await fetchRecipeBySlug(slug)
      if (active) {
        setRecipe(data)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <div className="px-5 sm:px-10 lg:px-16 py-24 max-w-3xl mx-auto">
        <p className="font-sans font-light text-sm text-black/60">Loading recipe…</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="px-5 sm:px-10 lg:px-16 py-24 max-w-3xl mx-auto text-center">
        <h1 className="font-display text-3xl uppercase mb-4">Recipe not found</h1>
        <Link
          to="/recipes"
          className="font-sans font-semibold text-xs tracking-[0.25em] uppercase border-b border-black pb-1"
        >
          Back to recipes
        </Link>
      </div>
    )
  }

  const description = `${recipe.name} by ${site.fullName}. ${recipe.steps?.[0] || 'Authentic Indian recipe from Manhattan.'}`

  return (
    <article className="px-5 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-3xl mx-auto min-h-[60vh]">
      <Seo
        title={`${recipe.name} | Indian Recipe by Chef Zahir Khan`}
        description={description.slice(0, 160)}
        path={`/recipes/${recipe.slug}`}
        image={recipe.images?.[0] || '/images/food-main.jpg'}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Recipes', path: '/recipes' },
            { name: recipe.name, path: `/recipes/${recipe.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Recipe',
            name: recipe.name,
            author: { '@type': 'Person', name: site.fullName },
            recipeInstructions: (recipe.steps || []).map((text, i) => ({
              '@type': 'HowToStep',
              position: i + 1,
              text,
            })),
            image: (recipe.images || []).map((src) =>
              src.startsWith('http') ? src : `${site.url}${src}`,
            ),
          },
        ]}
      />

      <Link
        to="/recipes"
        className="inline-block font-sans font-light text-xs tracking-[0.2em] uppercase mb-8 hover:opacity-60"
      >
        ← All recipes
      </Link>

      <h1 className="font-display text-3xl sm:text-5xl tracking-wide uppercase mb-8">
        {recipe.name}
      </h1>

      {recipe.images?.length > 0 && (
        <div className="space-y-4 mb-12">
          {recipe.images.map((src) => (
            <img
              key={src}
              src={src}
              alt={`${recipe.name} — Indian recipe by Chef Zahir Khan`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}

      <h2 className="font-sans font-semibold text-sm tracking-[0.25em] uppercase mb-6">
        Steps to make it
      </h2>
      <ol className="space-y-4 list-decimal list-inside">
        {(recipe.steps || []).map((step, index) => (
          <li key={`${index}-${step.slice(0, 20)}`} className="font-sans font-light text-base leading-relaxed pl-1">
            {step}
          </li>
        ))}
      </ol>
    </article>
  )
}
